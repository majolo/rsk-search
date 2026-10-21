import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RskPublicationType, RskShortTranscript } from '../../../../lib/api-client/models';
import { SearchAPIClient } from '../../../../lib/api-client/services/search';
import { AlertService } from '../../../core/service/alert/alert.service';
import { AudioService, PlayerMode } from '../../../core/service/audio/audio.service';

@Component({
  selector: 'app-random-episode-button',
  templateUrl: './random-episode-button.component.html',
})
export class RandomEpisodeButtonComponent implements OnInit {
  loading = signal(true);
  loadFailed = signal(false);
  episodes = signal<RskShortTranscript[]>([]);

  private currentAudioId: string;
  private apiClient = inject(SearchAPIClient);
  private audioService = inject(AudioService);
  private alertService = inject(AlertService);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.audioService.status.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status) => {
      this.currentAudioId = status.audioID;
    });
    // Load ahead of the click so playback stays within the browser's user gesture.
    this.loadEpisodes();
  }

  private loadEpisodes(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.apiClient
      .listTranscripts({})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.episodes.set(
            (result.episodes ?? []).filter(
              (episode) =>
                !!episode.shortId &&
                episode.media?.audio &&
                !episode.media.audioRestricted &&
                (episode.publicationType === RskPublicationType.PUBLICATION_TYPE_RADIO ||
                  episode.publicationType === RskPublicationType.PUBLICATION_TYPE_PODCAST),
            ),
          );
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
          this.alertService.danger('Could not load episodes. Use Retry random episode to try again.');
        },
      });
  }

  playRandomEpisode(): void {
    if (this.loading()) {
      return;
    }
    if (this.loadFailed()) {
      this.loadEpisodes();
      return;
    }

    const candidates = this.episodes().filter((episode) => episode.shortId !== this.currentAudioId);
    const pool = candidates.length ? candidates : this.episodes();
    if (!pool.length) {
      return;
    }

    const episode = pool[Math.floor(Math.random() * pool.length)];
    this.audioService.setAudioSrcFromEpisodeName(episode.shortId, episode.name, PlayerMode.Default);
    this.audioService.seekAudio(0);
    this.audioService.playAudio()?.catch((error) => {
      // Another click or a pause can cancel a pending play request.
      if (error.name !== 'AbortError') {
        this.alertService.danger('Could not start playback. Try another episode or press Play in the audio player.');
      }
    });
  }
}
