package todo

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"todo-flow/server/auth"
	"todo-flow/server/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) Register(r gin.IRoutes) {
	r.GET("/todos", h.List)
	r.POST("/todos", h.Create)
	r.PATCH("/todos/:id", h.Update)
	r.DELETE("/todos/:id", h.Delete)
}

func (h *Handler) List(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	todos := []models.Todo{}
	if err := h.db.Where("user_id = ?", userID).Order("id asc").Find(&todos).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, todos)
}

type createRequest struct {
	Title string `json:"title"`
}

func (h *Handler) Create(c *gin.Context) {
	var req createRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
		return
	}
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}

	todo := models.Todo{Title: title, UserID: userID}
	if err := h.db.Create(&todo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, todo)
}

type updateRequest struct {
	Title     *string `json:"title"`
	Completed *bool   `json:"completed"`
}

func (h *Handler) Update(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req updateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.Title == nil && req.Completed == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	userID, ok := h.requireUser(c)
	if !ok {
		return
	}

	updates := map[string]any{}
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
			return
		}
		updates["title"] = title
	}
	if req.Completed != nil {
		updates["completed"] = *req.Completed
	}

	var todo models.Todo
	err = h.db.Where("id = ? AND user_id = ?", id, userID).First(&todo).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "todo not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if err := h.db.Model(&todo).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&todo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, todo)
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	userID, ok := h.requireUser(c)
	if !ok {
		return
	}

	res := h.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Todo{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "todo not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) requireUser(c *gin.Context) (uint, bool) {
	userID, ok := auth.UserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return 0, false
	}
	return userID, true
}

func parseID(raw string) (uint, error) {
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || n == 0 {
		return 0, errors.New("invalid id")
	}
	return uint(n), nil
}
