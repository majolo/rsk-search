import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RskPublicationType, RskShortTranscript } from '../../../../lib/api-client/models';
import { SearchAPIClient } from '../../../../lib/api-client/services/search';
import { AlertService } from '../../../core/service/alert/alert.service';
import { AudioService, PlayerMode } from '../../../core/service/audio/audio.service';
import { RandomEpisodeButtonComponent } from './random-episode-button.component';

const radio: RskShortTranscript = {
  shortId: 'xfm-S1E01',
  name: 'XFM episode',
  publicationType: RskPublicationType.PUBLICATION_TYPE_RADIO,
  media: { audio: true },
};
const podcast: RskShortTranscript = {
  ...radio,
  shortId: 'podcast-S1E01',
  name: 'Podcast episode',
  publicationType: RskPublicationType.PUBLICATION_TYPE_PODCAST,
};

describe('RandomEpisodeButtonComponent', () => {
  let api: { listTranscripts: ReturnType<typeof vi.fn> };
  let audio: {
    status: BehaviorSubject<{ audioID: string }>;
    setAudioSrcFromEpisodeName: ReturnType<typeof vi.fn>;
    seekAudio: ReturnType<typeof vi.fn>;
    playAudio: ReturnType<typeof vi.fn>;
  };
  let alerts: { danger: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { listTranscripts: vi.fn().mockReturnValue(of({ episodes: [radio, podcast] })) };
    audio = {
      status: new BehaviorSubject({ audioID: '' }),
      setAudioSrcFromEpisodeName: vi.fn(),
      seekAudio: vi.fn(),
      playAudio: vi.fn().mockResolvedValue(undefined),
    };
    alerts = { danger: vi.fn() };
    TestBed.configureTestingModule({
      imports: [RandomEpisodeButtonComponent],
      providers: [
        { provide: SearchAPIClient, useValue: api },
        { provide: AudioService, useValue: audio },
        { provide: AlertService, useValue: alerts },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(RandomEpisodeButtonComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('only offers radio and podcast episodes with playable, unrestricted audio', () => {
    api.listTranscripts.mockReturnValue(
      of({
        episodes: [
          radio,
          podcast,
          { ...radio, publicationType: RskPublicationType.PUBLICATION_TYPE_TV },
          { ...radio, media: { audio: false } },
          { ...podcast, media: { audio: true, audioRestricted: true } },
          { ...radio, shortId: '' },
        ],
      }),
    );
    expect(render().componentInstance.episodes()).toEqual([radio, podcast]);
  });

  it('starts another episode from zero in the regular player directly on click', () => {
    audio.status.next({ audioID: radio.shortId });
    const fixture = render();
    fixture.nativeElement.querySelector('button').click();
    expect(audio.setAudioSrcFromEpisodeName).toHaveBeenCalledWith(podcast.shortId, podcast.name, PlayerMode.Default);
    expect(audio.seekAudio).toHaveBeenCalledWith(0);
    expect(audio.playAudio).toHaveBeenCalledOnce();
    expect(api.listTranscripts).toHaveBeenCalledOnce();
  });

  it('disables playback while loading and when no playable episodes are available', () => {
    const response = new Subject<{ episodes: RskShortTranscript[] }>();
    api.listTranscripts.mockReturnValue(response);
    const fixture = render();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
    fixture.componentInstance.playRandomEpisode();
    expect(audio.playAudio).not.toHaveBeenCalled();
    response.next({ episodes: [] });
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
  });

  it('allows retrying a failed episode request without starting playback asynchronously', () => {
    api.listTranscripts.mockReturnValueOnce(throwError(() => new Error('offline')));
    const fixture = render();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Retry random episode');
    button.click();
    fixture.detectChanges();
    expect(api.listTranscripts).toHaveBeenCalledTimes(2);
    expect(audio.playAudio).not.toHaveBeenCalled();
    button.click();
    expect(audio.playAudio).toHaveBeenCalledOnce();
  });
});
