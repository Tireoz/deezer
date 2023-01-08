import { getAlbum, getPlaylist, getTrack } from "./API";
import { CustomPlugin, DisTubeError, Playlist, checkInvalidKey } from "distube";
import type { Song } from "distube";
import type { VoiceBasedChannel } from "discord.js";
import type { PlayOptions, PlaylistInfo, Queue } from "distube";
import SoundCloudPlugin, { SearchType } from "@distube/soundcloud";

const SUPPORTED_TYPES = ["album", "playlist", "track"];

const REGEX = /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?(track|album|playlist)\/(\d+)\/?(?:\?.*?)?$/;

type Falsy = undefined | null | false | 0 | "";
const isTruthy = <T>(x: T | Falsy): x is T => Boolean(x);

declare type DeezerPluginOptions = {
  parallel?: boolean;
  emitEventsAfterFetching?: boolean;
};

export class DeezerPlugin extends CustomPlugin {
  parallel: boolean;
  emitEventsAfterFetching: boolean;
  constructor(options: DeezerPluginOptions = {}) {
    super();
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new DisTubeError("INVALID_TYPE", ["object", "undefined"], options, "DeezerPluginOptions");
    }
    checkInvalidKey(options, ["parallel", "emitEventsAfterFetching"], "DeezerPluginOptions");
    this.parallel = options.parallel ?? true;
    if (typeof this.parallel !== "boolean") {
      throw new DisTubeError("INVALID_TYPE", "boolean", this.parallel, "DeezerPluginOptions.parallel");
    }
    this.emitEventsAfterFetching = options.emitEventsAfterFetching ?? false;
    if (typeof this.emitEventsAfterFetching !== "boolean") {
      throw new DisTubeError(
        "INVALID_TYPE",
        "boolean",
        this.emitEventsAfterFetching,
        "DeezerPluginOptions.emitEventsAfterFetching",
      );
    }
  }

  parseURL(url: string): { type?: string; id?: string } {
    const [, type, id] = url.match(REGEX) ?? [];
    return { type, id };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async validate(url: string) {
    if (typeof url !== "string" || !url.includes("deezer")) return false;
    const { type, id } = this.parseURL(url);
    if (!type || !id || !SUPPORTED_TYPES.includes(type)) return false;
    return true;
  }

  async play(voiceChannel: VoiceBasedChannel, url: string, options: PlayOptions) {
    const DT = this.distube;
    const { member, textChannel, skip, position, metadata } = Object.assign({ position: 0 }, options);
    const { type, id } = this.parseURL(url);
    if (!type || !id) {
      throw new DisTubeError("DEEZER_PLUGIN_INVALID_URL", `Invalid Deezer url: ${url}`);
    }
    const api = type === "track" ? getTrack(id) : type === "album" ? getAlbum(id) : getPlaylist(id);
    const data = await api.catch(e => {
      throw new DisTubeError("DEEZER_PLUGIN_API_ERROR", e.message);
    });
    if (!data.type || !SUPPORTED_TYPES.includes(data.type)) {
      throw new DisTubeError("DEEZER_PLUGIN_NOT_SUPPORTED", "This deezer link is not supported.");
    }
    if (data.type === "track") {
      const query = `${data.title} ${data.contributors.map((a: any) => a.name).join(" ")}`;
      const result = await this.search(query);
      if (!result) throw new DisTubeError("DEEZER_PLUGIN_NO_RESULT", `Cannot find "${query}" on SoundCloud.`);
      await DT.play(voiceChannel, result, options);
    } else {
      const name = data.title;
      const thumbnail =
        data.type == "album"
          ? data.cover_xl || data.cover_big || data.cover_medium || data.cover
          : data.picture_xl || data.picture_big || data.picture_medium || data.picture;
      const queries: string[] = data.tracks.data.map((t: any) => `${t.title} ${t.artist.name}`);
      const url = data.link;
      let firstSong: Song | undefined;
      const getFirstSong = async () => {
        const firstQuery = queries.shift();
        if (!firstQuery) return;
        const result = await this.search(firstQuery);
        if (!result) return;
        firstSong = result;
      };
      while (!firstSong) {
        await getFirstSong();
      }

      if (!firstSong) {
        throw new DisTubeError("DEEZER_PLUGIN_NO_RESULT", `Cannot find any tracks of "${name}" on SoundCloud.`);
      }
      const queue = DT.getQueue(voiceChannel);

      const playlistInfo: PlaylistInfo = {
        source: "deezer",
        songs: [firstSong],
        name,
        thumbnail,
        member,
        url,
      };
      const playlist = new Playlist(playlistInfo, { member, metadata });
      const fetchTheRest = async (q: Queue, fs: Song) => {
        if (queries.length) {
          let results: (Song | null)[] = [];
          if (this.parallel) {
            results = await Promise.all(queries.map(query => this.search(query)));
          } else {
            for (let i = 0; i < queries.length; i++) {
              results[i] = await this.search(queries[i]);
            }
          }
          playlist.songs = results.filter(isTruthy).map(r => {
            const s = r;
            s.playlist = playlist;
            return s;
          });
          q.addToQueue(playlist.songs, !skip && position > 0 ? position + 1 : position);
        }
        playlist.songs.unshift(fs);
      };
      if (queue) {
        queue.addToQueue(firstSong, position);
        if (skip) queue.skip();
        else if (!this.emitEventsAfterFetching) DT.emit("addList", queue, playlist);
        await fetchTheRest(queue, firstSong);
        if (!skip && this.emitEventsAfterFetching) DT.emit("addList", queue, playlist);
      } else {
        let newQueue = await DT.queues.create(voiceChannel, firstSong, textChannel);
        while (newQueue === true) {
          await getFirstSong();
          newQueue = await DT.queues.create(voiceChannel, firstSong, textChannel);
        }
        if (!this.emitEventsAfterFetching) {
          if (DT.options.emitAddListWhenCreatingQueue) DT.emit("addList", newQueue, playlist);
          DT.emit("playSong", newQueue, firstSong);
        }
        await fetchTheRest(newQueue, firstSong);
        if (this.emitEventsAfterFetching) {
          if (DT.options.emitAddListWhenCreatingQueue) DT.emit("addList", newQueue, playlist);
          DT.emit("playSong", newQueue, firstSong);
        }
      }
    }
  }

  async search(query: string) {
    try {
      const scPlugin = new SoundCloudPlugin();
      const [song] = await scPlugin.search(query, SearchType.Track, 1);
      return song;
    } catch {
      return null;
    }
  }
}

export default DeezerPlugin;
