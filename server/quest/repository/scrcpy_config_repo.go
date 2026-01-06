package repository

import (
	"sync"

	"vrcontrol/server/quest/model"
)

// ScrcpyConfigRepository manages scrcpy configuration persistence
type ScrcpyConfigRepository struct {
	repo   *JSONRepository
	config *model.ScrcpyConfig
	mu     sync.RWMutex
}

// NewScrcpyConfigRepository creates a new scrcpy config repository
func NewScrcpyConfigRepository(filePath string) *ScrcpyConfigRepository {
	return &ScrcpyConfigRepository{
		repo:   NewJSONRepository(filePath),
		config: model.DefaultScrcpyConfig(),
	}
}

// Load loads the configuration from file
func (r *ScrcpyConfigRepository) Load() error {
	var config model.ScrcpyConfig
	if err := r.repo.Load(&config); err != nil {
		// If file doesn't exist or error, use default config
		r.mu.Lock()
		r.config = model.DefaultScrcpyConfig()
		r.mu.Unlock()
		return nil
	}

	r.mu.Lock()
	r.config = &config
	r.mu.Unlock()

	return nil
}

// Save saves the configuration to file
func (r *ScrcpyConfigRepository) Save() error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return r.repo.Save(r.config)
}

// save internal save method (no locking)
func (r *ScrcpyConfigRepository) save() error {
	return r.repo.Save(r.config)
}

// Get returns the current configuration
func (r *ScrcpyConfigRepository) Get() (*model.ScrcpyConfig, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.config == nil {
		return model.DefaultScrcpyConfig(), nil
	}

	// Return a copy to prevent external modification
	configCopy := *r.config
	return &configCopy, nil
}

// Update updates the configuration
func (r *ScrcpyConfigRepository) Update(config *model.ScrcpyConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.config = config
	return r.save()
}
