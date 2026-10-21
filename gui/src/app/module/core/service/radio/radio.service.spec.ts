import { BehaviorSubject, of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { RadioService } from './radio.service';
import { AudioService, PlayerMode, PlayerState, Status } from '../audio/audio.service';
import { SearchAPIClient } from '../../../../lib/api-client/services/search';
import { SessionService } from '../session/session.service';

function setup(loggedIn = false) {
  const mode$ = new BehaviorSubject(PlayerMode.Default);
  const status = new Subject<Status>();
  const audio = {
    mode$,
    status,
    setAudioSrcFromEpisodeName: vi.fn(() => mode$.next(PlayerMode.Radio)),
    seekAudio: vi.fn(),
    playAudio: vi.fn(),
    reset: vi.fn(() => mode$.next(PlayerMode.Default)),
  };
  const api = {
    getState: vi.fn(() => of({ currentEpisode: { shortId: 'xfm-S1E01', startedAt: new Date().toISOString() }, currentTimestampMs: 100 })),
    getNext: vi.fn(() => of({ shortId: 'xfm-S1E02' })),
    putState: vi.fn(() => of({})),
  };
  const session = { getToken: () => (loggedIn ? 'token' : null), onTokenChange: new Subject<string>() };
  const radio = new RadioService(audio as unknown as AudioService, api as unknown as SearchAPIClient, session as unknown as SessionService);
  return { radio, audio, api, status };
}

describe('RadioService', () => {
  it('starts guest radio with a random episode and advances when it ends', () => {
    const { radio, audio, api, status } = setup();
    radio.start();

    expect(api.getState).not.toHaveBeenCalled();
    expect(api.getNext).toHaveBeenCalledTimes(1);
    expect(audio.setAudioSrcFromEpisodeName).toHaveBeenCalledWith('xfm-S1E02', 'Scrimpton Radio', PlayerMode.Radio);
    expect(audio.seekAudio).toHaveBeenCalledWith(0);
    expect(audio.playAudio).toHaveBeenCalled();
    expect(radio.active).toBe(true);

    status.next({ audioID: 'xfm-S1E02', state: PlayerState.playing, currentTime: 20 } as Status);
    expect(api.putState).not.toHaveBeenCalled();

    status.next({ audioID: 'xfm-S1E02', state: PlayerState.ended } as Status);
    expect(api.getNext).toHaveBeenCalledTimes(2);

    radio.stop();
    expect(radio.active).toBe(false);
    status.next({ audioID: 'xfm-S1E02', state: PlayerState.ended } as Status);
    expect(api.getNext).toHaveBeenCalledTimes(2);
  });

  it('resumes and saves playback for logged-in users', () => {
    const { radio, audio, api, status } = setup(true);
    radio.start();

    expect(api.getState).toHaveBeenCalledTimes(1);
    expect(api.getNext).not.toHaveBeenCalled();
    expect(audio.seekAudio).toHaveBeenCalledWith(100);

    status.next({ audioID: 'xfm-S1E01', state: PlayerState.playing, currentTime: 120 } as Status);
    expect(api.putState).toHaveBeenCalledTimes(1);
  });
});
