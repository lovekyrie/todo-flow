package routes

import (
	"todo-flow/server/auth"
	"todo-flow/server/todo"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Mount(r *gin.Engine, db *gorm.DB, secret string) {
	a := auth.New(db, secret)
	r.POST("/api/auth/register", a.Register)
	r.POST("/api/auth/login", a.Login)

	authed := r.Group("/api")
	authed.Use(a.Middleware())
	authed.GET("/me", a.Me)
	todo.NewHandler(db).Register(authed)
}
