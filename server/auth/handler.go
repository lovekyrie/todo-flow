package auth

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"todo-flow/server/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const UserIDKey = "userID"

type Handler struct {
	db     *gorm.DB
	secret []byte
}

func New(db *gorm.DB, secret string) *Handler {
	return &Handler{db: db, secret: []byte(secret)}
}

type credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type session struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

type claims struct {
	UserID uint `json:"uid"`
	jwt.RegisteredClaims
}

func (h *Handler) Register(c *gin.Context) {
	req, ok := bindCredentials(c)
	if !ok {
		return
	}

	var count int64
	if err := h.db.Model(&models.User{}).Where("username = ?", req.Username).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "username taken"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	user := models.User{Username: req.Username, PasswordHash: string(hash)}
	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	h.writeSession(c, http.StatusCreated, user)
}

func (h *Handler) Login(c *gin.Context) {
	req, ok := bindCredentials(c)
	if !ok {
		return
	}

	var user models.User
	err := h.db.Where("username = ?", req.Username).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}
	h.writeSession(c, http.StatusOK, user)
}

func (h *Handler) Me(c *gin.Context) {
	userID, ok := UserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *Handler) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		token := strings.TrimPrefix(header, "Bearer ")
		if token == "" || token == header {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		userID, err := h.parse(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Set(UserIDKey, userID)
		c.Next()
	}
}

func bindCredentials(c *gin.Context) (credentials, bool) {
	var req credentials
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return credentials{}, false
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username and password are required"})
		return credentials{}, false
	}
	return req, true
}

func (h *Handler) writeSession(c *gin.Context, status int, user models.User) {
	token, err := h.sign(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(status, session{Token: token, User: user})
}

func (h *Handler) sign(userID uint) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		},
	})
	return token.SignedString(h.secret)
}

func (h *Handler) parse(raw string) (uint, error) {
	parsed, err := jwt.ParseWithClaims(raw, &claims{}, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return h.secret, nil
	})
	if err != nil {
		return 0, err
	}
	parsedClaims, ok := parsed.Claims.(*claims)
	if !ok || !parsed.Valid || parsedClaims.UserID == 0 {
		return 0, errors.New("invalid token")
	}
	return parsedClaims.UserID, nil
}

func UserID(c *gin.Context) (uint, bool) {
	value, ok := c.Get(UserIDKey)
	if !ok {
		return 0, false
	}
	id, ok := value.(uint)
	return id, ok && id != 0
}
