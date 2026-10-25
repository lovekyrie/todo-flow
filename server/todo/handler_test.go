package todo

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"todo-flow/server/auth"
	"todo-flow/server/models"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type todoJSON struct {
	ID        uint   `json:"id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	UserID    uint   `json:"userId"`
}

func setup(t *testing.T) (*gin.Engine, *gorm.DB, models.User) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "todo.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Todo{}); err != nil {
		t.Fatal(err)
	}
	local := models.User{Username: "local", PasswordHash: "hash"}
	if err := db.Create(&local).Error; err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	api := r.Group("/api")
	api.Use(func(c *gin.Context) {
		c.Set(auth.UserIDKey, local.ID)
		c.Next()
	})
	NewHandler(db).Register(api)
	return r, db, local
}

func do(r http.Handler, method, path, body string) *httptest.ResponseRecorder {
	var reader *bytes.Reader
	if body == "" {
		reader = bytes.NewReader(nil)
	} else {
		reader = bytes.NewReader([]byte(body))
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestTodoCRUD(t *testing.T) {
	r, db, local := setup(t)

	w := do(r, http.MethodGet, "/api/todos", "")
	if w.Code != http.StatusOK || w.Body.String() != "[]" {
		t.Fatalf("empty list: status %d body %s", w.Code, w.Body.String())
	}

	w = do(r, http.MethodPost, "/api/todos", `{"title":"  buy milk  "}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("create status %d body %s", w.Code, w.Body.String())
	}
	var created todoJSON
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.ID == 0 || created.Title != "buy milk" || created.Completed || created.UserID != local.ID {
		t.Fatalf("created %+v", created)
	}
	if created.CreatedAt == "" || created.UpdatedAt == "" {
		t.Fatalf("missing timestamps: %+v", created)
	}

	w = do(r, http.MethodPost, "/api/todos", `{"title":"   "}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("blank title status %d body %s", w.Code, w.Body.String())
	}

	other := models.User{Username: "other", PasswordHash: "dev-only"}
	if err := db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Todo{Title: "hidden", UserID: other.ID}).Error; err != nil {
		t.Fatal(err)
	}

	w = do(r, http.MethodGet, "/api/todos", "")
	if w.Code != http.StatusOK {
		t.Fatalf("list status %d body %s", w.Code, w.Body.String())
	}
	var list []todoJSON
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != created.ID || list[0].Title != "buy milk" {
		t.Fatalf("list %+v", list)
	}

	w = do(r, http.MethodPatch, "/api/todos/1", `{"title":"bought milk","completed":true}`)
	if w.Code != http.StatusOK {
		t.Fatalf("patch status %d body %s", w.Code, w.Body.String())
	}
	var updated todoJSON
	if err := json.Unmarshal(w.Body.Bytes(), &updated); err != nil {
		t.Fatal(err)
	}
	if updated.Title != "bought milk" || !updated.Completed {
		t.Fatalf("updated %+v", updated)
	}

	w = do(r, http.MethodPatch, "/api/todos/1", `{"completed":false}`)
	if w.Code != http.StatusOK {
		t.Fatalf("patch false status %d body %s", w.Code, w.Body.String())
	}
	if err := json.Unmarshal(w.Body.Bytes(), &updated); err != nil {
		t.Fatal(err)
	}
	if updated.Completed || updated.Title != "bought milk" {
		t.Fatalf("completed false %+v", updated)
	}

	w = do(r, http.MethodPatch, "/api/todos/99", `{"title":"missing"}`)
	if w.Code != http.StatusNotFound {
		t.Fatalf("missing patch status %d", w.Code)
	}
	w = do(r, http.MethodPatch, "/api/todos/1", `{}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("empty patch status %d", w.Code)
	}
	w = do(r, http.MethodPatch, "/api/todos/abc", `{"title":"x"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bad id status %d", w.Code)
	}

	w = do(r, http.MethodDelete, "/api/todos/1", "")
	if w.Code != http.StatusNoContent {
		t.Fatalf("delete status %d body %s", w.Code, w.Body.String())
	}
	w = do(r, http.MethodGet, "/api/todos", "")
	if w.Body.String() != "[]" {
		t.Fatalf("after delete body %s", w.Body.String())
	}
	w = do(r, http.MethodDelete, "/api/todos/1", "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("second delete status %d", w.Code)
	}
}
