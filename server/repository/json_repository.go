package repository

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// JSONRepository 通用 JSON 資料存儲
type JSONRepository struct {
	filePath string
	mu       sync.RWMutex
}

// NewJSONRepository 創建新的 JSON Repository
func NewJSONRepository(filePath string) *JSONRepository {
	return &JSONRepository{
		filePath: filePath,
	}
}

// Load 從文件加載資料
func (r *JSONRepository) Load(data interface{}) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// 檢查文件是否存在
	if _, err := os.Stat(r.filePath); os.IsNotExist(err) {
		// 文件不存在，返回空資料（不是錯誤）
		return nil
	}

	// 讀取文件
	content, err := os.ReadFile(r.filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// 如果文件為空，返回
	if len(content) == 0 {
		return nil
	}

	// 解析 JSON
	if err := json.Unmarshal(content, data); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	return nil
}

// Save 保存資料到文件
func (r *JSONRepository) Save(data interface{}) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 確保目錄存在
	dir := filepath.Dir(r.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 序列化為 JSON（美化輸出）
	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	// 寫入臨時文件
	tempFile := r.filePath + ".tmp"
	if err := os.WriteFile(tempFile, content, 0644); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}

	// 原子性重命名
	if err := os.Rename(tempFile, r.filePath); err != nil {
		os.Remove(tempFile) // 清理臨時文件
		return fmt.Errorf("failed to rename file: %w", err)
	}

	return nil
}

// Exists 檢查文件是否存在
func (r *JSONRepository) Exists() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	_, err := os.Stat(r.filePath)
	return !os.IsNotExist(err)
}

// Delete 刪除文件
func (r *JSONRepository) Delete() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if err := os.Remove(r.filePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}
