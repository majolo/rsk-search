package db

import (
	"fmt"
	"sort"

	"github.com/warmans/rsk-search/pkg/models"
	"github.com/warmans/rsk-search/pkg/transcript"
)

// Keep annotations added to the episode JSON when the database copy has none.
// Build the replacement separately so a failed match never leaves partial ranges.
func preserveMissingSynopsis(previous models.Transcript, updated *models.Transcript) error {
	if len(previous.Synopsis) == 0 || len(updated.Synopsis) > 0 {
		return nil
	}
	if sameSynopsisLines(previous.Transcript, updated.Transcript) {
		updated.Synopsis = previous.Synopsis
		return nil
	}

	synopses := make([]models.Synopsis, 0, len(previous.Synopsis))
	for _, synopsis := range previous.Synopsis {
		start, end := -1, -1
		for i, line := range previous.Transcript {
			if line.Position == synopsis.StartPos {
				start = i
			}
			if line.Position == synopsis.EndPos {
				end = i
			}
		}
		// The importer can close a synopsis one position beyond the final row.
		atEnd := len(previous.Transcript) > 0 && synopsis.EndPos == previous.Transcript[len(previous.Transcript)-1].Position+transcript.PosSpacing
		if atEnd {
			end = len(previous.Transcript)
		}
		if start < 0 || end < start {
			return fmt.Errorf("synopsis %q has an invalid existing range", synopsis.Description)
		}

		stop := end + 1
		if atEnd {
			stop = end
		}
		// Match every line in the range, including its end boundary when present.
		// No fuzzy matching: changed, missing or repeated passages are left alone.
		lines := previous.Transcript[start:stop]
		match := uniqueSynopsisMatch(lines, updated.Transcript)
		if match < 0 {
			return fmt.Errorf("synopsis %q cannot be matched unambiguously", synopsis.Description)
		}
		synopsis.StartPos = updated.Transcript[match].Position
		last := match + len(lines) - 1
		synopsis.EndPos = updated.Transcript[last].Position
		if atEnd {
			if last+1 < len(updated.Transcript) {
				synopsis.EndPos = updated.Transcript[last+1].Position
			} else {
				synopsis.EndPos += transcript.PosSpacing
			}
		}
		synopses = append(synopses, synopsis)
	}
	// A conversation may have moved within the transcript.
	sort.SliceStable(synopses, func(i, j int) bool { return synopses[i].StartPos < synopses[j].StartPos })
	updated.Synopsis = synopses
	return nil
}

func uniqueSynopsisMatch(lines, updated []models.Dialog) int {
	match := -1
	for start := 0; start+len(lines) <= len(updated); start++ {
		matches := true
		for i, line := range lines {
			if !sameSynopsisLine(line, updated[start+i]) {
				matches = false
				break
			}
		}
		if matches {
			if match >= 0 {
				return -1
			}
			match = start
		}
	}
	return match
}

func sameSynopsisLines(previous, updated []models.Dialog) bool {
	if len(previous) != len(updated) {
		return false
	}
	for i, line := range previous {
		if line.Position != updated[i].Position || !sameSynopsisLine(line, updated[i]) {
			return false
		}
	}
	return true
}

func sameSynopsisLine(previous, updated models.Dialog) bool {
	// Timing, review flags and derived metadata do not identify the conversation.
	return previous.Content == updated.Content && previous.Actor == updated.Actor && previous.Type == updated.Type
}
