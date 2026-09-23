export type MediaType = "movie" | "tv" | "anime" | "manga" | "book" | "game";

// `manual` is reserved for user-created entries.
export type ProviderId = "tmdb" | "anilist" | "rawg" | "itunes" | "manual";

// Library identity: `provider:media_type:id`.
export type MediaKey = string;

export interface PaginatedResult<T> {
  results: T[];
  page: number;
  total_pages: number;
  total_results: number;
}

// Every provider maps into this shape.
export interface MediaItem {
  id: number | string;
  provider: ProviderId;
  media_key: MediaKey;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  media_type: MediaType;
  author?: string;
  episodes?: number | null;
  chapters?: number | null;
}

export interface Genre {
  id: GenreId;
  name: string;
}
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}
export interface VideoClip {
  key: string;
  site: string;
  type: string;
  name: string;
}

export interface MediaDetail {
  id: number | string;
  provider: ProviderId;
  media_key: MediaKey;
  media_type: MediaType;
  title: string;
  tagline: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string;
  runtime: number | null;
  genres: Genre[];
  cast: CastMember[];
  videos: VideoClip[];
  author?: string;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  status?: string;
  studios?: string[];
  subjects?: string[];
  developer?: string;
  publisher?: string;
  platforms?: string[];
  screenshots?: string[];
}

// Providers return absolute URLs.
export function getPosterUrl(item: MediaItem): string | null {
  return item.poster_path ?? null;
}

export const getYear = (item: MediaItem): string => {
  const d = item.release_date ?? item.first_air_date;
  return d ? d.slice(0, 4) : "";
};

export const getRating = (item: MediaItem): string =>
  item.vote_average > 0 ? item.vote_average.toFixed(1) : "";

export const MEDIA_LABELS: Record<MediaType, string> = {
  movie: "Movie",
  tv: "TV Show",
  anime: "Anime",
  manga: "Manga",
  book: "Book",
  game: "Game",
};

export const GENRE_SUPPORTED: ReadonlySet<MediaType> = new Set<MediaType>([
  "movie",
  "tv",
  "anime",
  "manga",
  "book",
  "game",
]);

// Numeric for TMDB, string slug for AniList/iTunes/RAWG.
export type GenreId = number | string;
export interface GenreOption {
  id: GenreId;
  name: string;
}
