/* tslint:disable */
import {
  RskPublicationType,
} from '.';

export interface RskEpisodeRating {
  bestof?: boolean;
  episode?: number;
  id?: string;
  name?: string;
  numRatingScores?: number;
  publication?: string;
  publicationType?: RskPublicationType;
  ratingScore?: number;
  releaseDate?: string;
  series?: number;
  special?: boolean;
  transcriptAvailable?: boolean;
}
