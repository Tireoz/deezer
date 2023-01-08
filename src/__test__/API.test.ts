import { getAlbum, getPlaylist, getTrack } from "../API";

test("getTrack", async () => {
  const track = await getTrack("1680957537");
  expect(track).toHaveProperty("id", 1680957537);
  expect(track).toHaveProperty("type", "track");

  expect(getTrack("1")).rejects.toThrow();
});

test("getAlbum", async () => {
  const album = await getAlbum("301640567");
  expect(album).toHaveProperty("id", 301640567);
  expect(album).toHaveProperty("type", "album");
  expect(album.tracks.data).toHaveLength(album.nb_tracks);

  expect(getAlbum("2")).rejects.toThrow();
});

test("getPlaylist", async () => {
  const playlist = await getPlaylist("7492050604");
  expect(playlist).toHaveProperty("id", 7492050604);
  expect(playlist).toHaveProperty("type", "playlist");
  expect(playlist.tracks.data).toHaveLength(playlist.nb_tracks);

  expect(getPlaylist("3")).rejects.toThrow();
});
