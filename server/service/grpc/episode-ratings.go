package grpc

import (
	"context"
	"maps"

	"github.com/warmans/rsk-search/gen/api"
	"github.com/warmans/rsk-search/pkg/models"
	"github.com/warmans/rsk-search/pkg/store/rw"
	"github.com/warmans/rsk-search/pkg/util"
	"google.golang.org/protobuf/types/known/emptypb"
)

func (s *TranscriptService) ListEpisodeRatings(ctx context.Context, _ *emptypb.Empty) (*api.EpisodeRatingList, error) {
	episodes, err := s.episodeCache.ListEpisodes()
	if err != nil {
		return nil, ErrInternal(err)
	}

	var pending map[string]models.Ratings
	if err := s.persistentDB.WithStore(func(store *rw.Store) error {
		var err error
		pending, err = store.ListPendingRatings(ctx)
		return err
	}); err != nil {
		return nil, ErrInternal(err)
	}

	result := &api.EpisodeRatingList{Episodes: make([]*api.EpisodeRating, 0, len(episodes))}
	for _, episode := range episodes {
		if episode.PublicationType != models.PublicationTypeRadio && episode.PublicationType != models.PublicationTypePodcast {
			continue
		}
		// Pending votes replace the same author's merged vote, without changing
		// the cached episode or returning individual voters' scores to the browser.
		ratings := models.Ratings{Scores: make(map[string]float32, len(episode.Ratings.Scores))}
		maps.Copy(ratings.Scores, episode.Ratings.Scores)
		maps.Copy(ratings.Scores, pending[episode.ShortID()].Scores)
		result.Episodes = append(result.Episodes, &api.EpisodeRating{
			Id:                  episode.ID(),
			Publication:         episode.Publication,
			PublicationType:     episode.PublicationType.Proto(),
			Series:              episode.Series,
			Episode:             episode.Episode,
			Name:                episode.Name,
			RatingScore:         ratings.Avg(),
			NumRatingScores:     int32(len(ratings.Scores)),
			TranscriptAvailable: len(episode.Transcript) > 0,
			Bestof:              episode.Bestof,
			Special:             episode.Special,
			ReleaseDate:         util.ShortDate(episode.ReleaseDate),
		})
	}
	return result, nil
}
