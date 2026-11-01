package db

import (
	"fmt"

	"github.com/warmans/rsk-search/pkg/models"
)

// Synopsis ranges refer to transcript positions. Keep annotations added to the
// episode JSON when an older database copy contains the same lines without them.
func preserveMissingSynopsis(previous models.Transcript, updated *models.Transcript) error {
	if len(previous.Synopsis) == 0 || len(updated.Synopsis) > 0 {
		return nil
	}

	if !sameSynopsisLines(previous.Transcript, updated.Transcript) {
		return fmt.Errorf("%s: export would remove %d synopsis blocks after the transcript changed; review the synopsis ranges and include them in the contribution before exporting", updated.ID(), len(previous.Synopsis))
	}

	updated.Synopsis = previous.Synopsis
	return nil
}

func sameSynopsisLines(previous, updated []models.Dialog) bool {
	if len(previous) != len(updated) {
		return false
	}
	for i, line := range previous {
		next := updated[i]
		if line.Position != next.Position || line.Content != next.Content || line.Actor != next.Actor || line.Type != next.Type {
			return false
		}
	}
	// Timing, review flags and derived metadata can change without moving the
	// conversation referenced by a synopsis block.
	return true
}
