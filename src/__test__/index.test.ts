import { DeezerPlugin } from "..";

test("DeezerPluginOptions", () => {
  const n: any = NaN;
  expect(new DeezerPlugin(undefined)).toBeInstanceOf(DeezerPlugin);
  expect(new DeezerPlugin({})).toBeInstanceOf(DeezerPlugin);
  expect(new DeezerPlugin({ parallel: true })).toBeInstanceOf(DeezerPlugin);
  expect(new DeezerPlugin({ emitEventsAfterFetching: false })).toBeInstanceOf(DeezerPlugin);
  expect(new DeezerPlugin({ parallel: false, emitEventsAfterFetching: true })).toBeInstanceOf(DeezerPlugin);
  expect(() => {
    new DeezerPlugin(n);
  }).toThrow("Expected 'object' or 'undefined' for 'DeezerPluginOptions', but got NaN (number)");
  for (const option of ["parallel", "emitEventsAfterFetching"]) {
    expect(() => {
      new DeezerPlugin({ [option]: n });
    }).toThrow(`Expected 'boolean' for 'DeezerPluginOptions.${option}', but got NaN (number)`);
  }
});

const plugin = new DeezerPlugin();
test("DeezerPlugin#validate()", async () => {
  const validUrls = [
    "https://www.deezer.com/en/album/301640567?utm_...",
    "https://www.deezer.com/en/album/301640567/?utm_...",
    "https://www.deezer.com/en/album/301640567",
    "https://deezer.com/album/301640567/",
    "https://www.deezer.com/en/track/1680957537",
    "https://deezer.com/track/1680957537",
    "https://www.deezer.com/en/playlist/7492050604",
    "https://deezer.com/playlist/7492050604",
  ];
  await Promise.all(validUrls.map(url => expect(plugin.validate(url)).resolves.toBe(true)));
  const invalidUrls = [
    "https://www.deezer.com/en/album/301640567/track?xyz",
    "https://www.deezer.com/en/artist/10803980",
    "https://deezer.com/artist/10803980",
    "https://www.deezer.com/en/profile/1990304482",
    "https://www.youtube.com/watch?v=fzcIk6zN-M4",
    "not a url",
  ];
  await Promise.all(invalidUrls.map(url => expect(plugin.validate(url)).resolves.toBe(false)));
});

test("DeezerPlugin#parseURL()", () => {
  const validUrls = [
    { url: "https://www.deezer.com/en/album/301640567?utm_...", type: "album", id: "301640567" },
    { url: "https://www.deezer.com/en/album/301640567/?utm_...", type: "album", id: "301640567" },
    { url: "https://www.deezer.com/en/album/301640567", type: "album", id: "301640567" },
    { url: "https://deezer.com/album/301640567/", type: "album", id: "301640567" },
    { url: "https://www.deezer.com/en/track/1680957537", type: "track", id: "1680957537" },
    { url: "https://deezer.com/track/1680957537", type: "track", id: "1680957537" },
    { url: "https://www.deezer.com/en/playlist/7492050604", type: "playlist", id: "7492050604" },
    { url: "https://deezer.com/playlist/7492050604", type: "playlist", id: "7492050604" },
  ];
  validUrls.map(({ url, type, id }) => expect(plugin.parseURL(url)).toEqual({ type, id }));
  const invalidUrls = [
    "https://www.deezer.com/en/album/301640567/track?xyz",
    "https://www.deezer.com/en/artist/10803980",
    "https://deezer.com/artist/10803980",
    "https://www.deezer.com/en/profile/1990304482",
    "https://www.youtube.com/watch?v=fzcIk6zN-M4",
    "not a url",
  ];
  invalidUrls.map(url => expect(plugin.parseURL(url)).toEqual({}));
});

test.todo("DeezerPlugin#play()");
