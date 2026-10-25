package auth_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"todo-flow/server/models"
	"todo-flow/server/routes"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setup(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "todo.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Todo{}); err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	routes.Mount(r, db, "test-secret")
	return r, db
}

func do(r http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

type authBody struct {
	Token string `json:"token"`
	User  struct {
		ID       uint   `json:"id"`
		Username string `json:"username"`
	} `json:"user"`
}

func TestRegisterHashesPasswordAndLogin(t *testing.T) {
	r, db := setup(t)

	w := do(r, http.MethodPost, "/api/auth/register", `{"username":"ada","password":"secret1"}`, "")
	if w.Code != http.StatusCreated {
		t.Fatalf("register status %d body %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "secret1") {
		t.Fatalf("response leaked password: %s", w.Body.String())
	}
	var registered authBody
	if err := json.Unmarshal(w.Body.Bytes(), &registered); err != nil {
		t.Fatal(err)
	}
	if registered.Token == "" || registered.User.Username != "ada" || registered.User.ID == 0 {
		t.Fatalf("registered %+v", registered)
	}

	var stored models.User
	if err := db.First(&stored, registered.User.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.PasswordHash == "secret1" {
		t.Fatal("stored plaintext password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(stored.PasswordHash), []byte("secret1")); err != nil {
		t.Fatalf("hash does not match password: %v", err)
	}

	w = do(r, http.MethodPost, "/api/auth/register", `{"username":"ada","password":"secret1"}`, "")
	if w.Code != http.StatusConflict {
		t.Fatalf("duplicate status %d", w.Code)
	}

	w = do(r, http.MethodPost, "/api/auth/login", `{"username":"ada","password":"wrong-pass"}`, "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("bad login status %d", w.Code)
	}

	w = do(r, http.MethodPost, "/api/auth/login", `{"username":"ada","password":"secret1"}`, "")
	if w.Code != http.StatusOK {
		t.Fatalf("login status %d body %s", w.Code, w.Body.String())
	}
	var loggedIn authBody
	if err := json.Unmarshal(w.Body.Bytes(), &loggedIn); err != nil {
		t.Fatal(err)
	}
	if loggedIn.Token == "" || loggedIn.User.ID != registered.User.ID {
		t.Fatalf("logged in %+v", loggedIn)
	}

	w = do(r, http.MethodGet, "/api/me", "", "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("me without token status %d", w.Code)
	}
	w = do(r, http.MethodGet, "/api/me", "", loggedIn.Token)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"username":"ada"`) {
		t.Fatalf("me status %d body %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "secret1") || strings.Contains(w.Body.String(), stored.PasswordHash) {
		t.Fatalf("me leaked secret: %s", w.Body.String())
	}
}

func TestTodoIsolation(t *testing.T) {
	r, _ := setup(t)

	ada := do(r, http.MethodPost, "/api/auth/register", `{"username":"ada","password":"secret1"}`, "")
	bob := do(r, http.MethodPost, "/api/auth/register", `{"username":"bob","password":"secret1"}`, "")
	if ada.Code != http.StatusCreated || bob.Code != http.StatusCreated {
		t.Fatalf("register ada %d bob %d", ada.Code, bob.Code)
	}
	var adaBody, bobBody authBody
	if err := json.Unmarshal(ada.Body.Bytes(), &adaBody); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(bob.Body.Bytes(), &bobBody); err != nil {
		t.Fatal(err)
	}

	created := do(r, http.MethodPost, "/api/todos", `{"title":"ada only"}`, adaBody.Token)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status %d body %s", created.Code, created.Body.String())
	}
	var todo struct {
		ID uint `json:"id"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &todo); err != nil {
		t.Fatal(err)
	}

	listed := do(r, http.MethodGet, "/api/todos", "", bobBody.Token)
	if listed.Code != http.StatusOK || listed.Body.String() != "[]" {
		t.Fatalf("bob list status %d body %s", listed.Code, listed.Body.String())
	}

	path := "/api/todos/" + jsonUint(todo.ID)
	if w := do(r, http.MethodPatch, path, `{"title":"hacked"}`, bobBody.Token); w.Code != http.StatusNotFound {
		t.Fatalf("bob patch status %d body %s", w.Code, w.Body.String())
	}
	if w := do(r, http.MethodDelete, path, "", bobBody.Token); w.Code != http.StatusNotFound {
		t.Fatalf("bob delete status %d body %s", w.Code, w.Body.String())
	}

	still := do(r, http.MethodGet, "/api/todos", "", adaBody.Token)
	if still.Code != http.StatusOK || !strings.Contains(still.Body.String(), "ada only") {
		t.Fatalf("ada list status %d body %s", still.Code, still.Body.String())
	}
	if w := do(r, http.MethodGet, "/api/todos", "", ""); w.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous list status %d", w.Code)
	}
}

func jsonUint(n uint) string {
	b, _ := json.Marshal(n)
	return string(b)
}
