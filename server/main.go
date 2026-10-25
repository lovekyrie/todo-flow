package main

import (
	"log"
	"net/http"
	"os"
	"time"
	"todo-flow/server/models"
	"todo-flow/server/routes"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	db, err := gorm.Open(sqlite.Open("database/todo.db"), &gorm.Config{
		Logger: logger.New(log.New(os.Stdout, "\r\n", log.LstdFlags), logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		}),
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Todo{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "todo-flow-dev"
	}

	r := gin.Default()
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Go Server is running",
		})
	})
	routes.Mount(r, db, secret)

	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
