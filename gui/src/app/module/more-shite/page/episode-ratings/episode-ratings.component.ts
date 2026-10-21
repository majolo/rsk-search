import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { EpisodeRatingsComponent } from '../../../search/component/episode-ratings/episode-ratings.component';

@Component({
  selector: 'app-episode-ratings-page',
  template: `
    <section class="p-3">
      <app-episode-ratings></app-episode-ratings>
    </section>
  `,
  imports: [EpisodeRatingsComponent],
})
export class EpisodeRatingsPageComponent implements OnInit {
  constructor(private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle('Episode ratings - Scrimpton');
  }
}
