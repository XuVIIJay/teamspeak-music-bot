import { describe, it, expect, beforeEach } from "vitest";
import { PlayQueue, type QueuedSong, PlayMode } from "./queue.js";

function makeSong(id: string, name: string = id): QueuedSong {
  return {
    id,
    name,
    artist: "Artist",
    album: "Album",
    platform: "netease",
    url: `https://example.com/${id}.mp3`,
    coverUrl: `https://example.com/${id}.jpg`,
    duration: 240,
  };
}

describe("PlayQueue", () => {
  let queue: PlayQueue;

  beforeEach(() => {
    queue = new PlayQueue();
  });

  it("starts empty", () => {
    expect(queue.isEmpty()).toBe(true);
    expect(queue.current()).toBeNull();
    expect(queue.size()).toBe(0);
  });

  it("adds and retrieves songs", () => {
    queue.add(makeSong("1", "Song A"));
    queue.add(makeSong("2", "Song B"));
    expect(queue.size()).toBe(2);
    expect(queue.list()[0].name).toBe("Song A");
    expect(queue.list()[1].name).toBe("Song B");
  });

  it("plays first song when starting", () => {
    queue.add(makeSong("1"));
    queue.add(makeSong("2"));
    queue.play();
    expect(queue.current()?.id).toBe("1");
  });

  it("advances to next song in sequential mode", () => {
    queue.setMode(PlayMode.Sequential);
    queue.add(makeSong("1"));
    queue.add(makeSong("2"));
    queue.add(makeSong("3"));
    queue.play();
    expect(queue.current()?.id).toBe("1");
    const next = queue.next();
    expect(next?.id).toBe("2");
    expect(queue.current()?.id).toBe("2");
  });

  it("returns null at end in sequential mode", () => {
    queue.setMode(PlayMode.Sequential);
    queue.add(makeSong("1"));
    queue.play();
    const next = queue.next();
    expect(next).toBeNull();
  });

  it("loops in loop mode", () => {
    queue.setMode(PlayMode.Loop);
    queue.add(makeSong("1"));
    queue.play();
    const next = queue.next();
    expect(next?.id).toBe("1");
  });

  it("goes to previous song", () => {
    queue.add(makeSong("1"));
    queue.add(makeSong("2"));
    queue.play();
    queue.next();
    expect(queue.current()?.id).toBe("2");
    queue.prev();
    expect(queue.current()?.id).toBe("1");
  });

  it("removes song by index", () => {
    queue.add(makeSong("1"));
    queue.add(makeSong("2"));
    queue.add(makeSong("3"));
    queue.remove(1);
    expect(queue.size()).toBe(2);
    expect(queue.list()[1].id).toBe("3");
  });

  it("removing a song before current shifts current index", () => {
    queue.setMode(PlayMode.Sequential);
    queue.add(makeSong("A"));
    queue.add(makeSong("B"));
    queue.add(makeSong("C"));
    queue.playAt(2); // playing C at index 2
    queue.remove(0); // remove A (before current)
    expect(queue.current()?.id).toBe("C"); // still on C
    expect(queue.getCurrentIndex()).toBe(1);
  });

  it("removing the currently-playing song lets next() advance to the shifted song", () => {
    queue.setMode(PlayMode.Sequential);
    queue.add(makeSong("A"));
    queue.add(makeSong("B"));
    queue.add(makeSong("C"));
    queue.add(makeSong("D"));
    queue.playAt(2); // playing C
    queue.remove(2); // remove C — D shifts into slot 2
    // Before the fix this returned null (D was silently skipped)
    expect(queue.next()?.id).toBe("D");
  });

  it("removing the only song clears the queue", () => {
    queue.add(makeSong("only"));
    queue.playAt(0);
    queue.remove(0);
    expect(queue.size()).toBe(0);
    expect(queue.current()).toBeNull();
    expect(queue.next()).toBeNull();
  });

  it("removing the last song while playing it advances to null in sequential mode", () => {
    queue.setMode(PlayMode.Sequential);
    queue.add(makeSong("A"));
    queue.add(makeSong("B"));
    queue.playAt(1); // playing B (last)
    queue.remove(1);
    expect(queue.size()).toBe(1);
    // currentIndex moved to 0, so next() should try to advance past the end
    expect(queue.next()).toBeNull();
  });

  it("clears all songs", () => {
    queue.add(makeSong("1"));
    queue.add(makeSong("2"));
    queue.clear();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.current()).toBeNull();
  });

  it("random mode returns a song", () => {
    queue.setMode(PlayMode.Random);
    queue.add(makeSong("1"));
    queue.add(makeSong("2"));
    queue.add(makeSong("3"));
    queue.play();
    const next = queue.next();
    expect(next).not.toBeNull();
  });

  it("random mode with single song returns null on next", () => {
    queue.setMode(PlayMode.Random);
    queue.add(makeSong("1"));
    queue.play();
    expect(queue.next()).toBeNull();
  });

  it("random mode plays each song exactly once then stops", () => {
    queue.setMode(PlayMode.Random);
    queue.add(makeSong("A"));
    queue.add(makeSong("B"));
    queue.add(makeSong("C"));
    queue.play();
    const played = new Set<string>();
    played.add(queue.current()!.id);
    for (let i = 0; i < 3; i++) {
      const song = queue.next();
      if (!song) break;
      played.add(song.id);
    }
    // All 3 songs should have been played
    expect(played).toEqual(new Set(["A", "B", "C"]));
    // next() after all played should return null
    expect(queue.next()).toBeNull();
  });

  it("random mode: removing currently-playing song does not skip others", () => {
    queue.setMode(PlayMode.Random);
    queue.add(makeSong("A"));
    queue.add(makeSong("B"));
    queue.add(makeSong("C"));
    queue.add(makeSong("D"));
    queue.play(); // plays A (index 0)
    const second = queue.next()!; // plays some song
    // Remove the currently-playing song
    const curIdx = queue.getCurrentIndex();
    queue.remove(curIdx);
    // Remaining songs (excluding A and the removed song) should all be reachable
    const played = new Set<string>();
    played.add("A"); // already played via play()
    played.add(second.id); // played and then removed
    let song = queue.next();
    while (song) {
      played.add(song.id);
      song = queue.next();
    }
    // All 4 original songs should have been played or accounted for
    expect(played).toEqual(new Set(["A", "B", "C", "D"]));
  });

  it("random mode: prev does not cause duplicate plays", () => {
    queue.setMode(PlayMode.Random);
    queue.add(makeSong("A"));
    queue.add(makeSong("B"));
    queue.add(makeSong("C"));
    queue.play(); // plays A
    queue.next(); // plays B or C
    queue.prev(); // go back — this song is now marked as played
    // Exhaust remaining songs
    const ids: string[] = [];
    let song = queue.next();
    while (song) {
      ids.push(song.id);
      song = queue.next();
    }
    // No song ID should appear more than once across the entire session
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("random mode: adding song mid-playback includes the new song", () => {
    queue.setMode(PlayMode.Random);
    queue.add(makeSong("A"));
    queue.add(makeSong("B"));
    queue.play(); // plays A
    queue.next(); // plays B
    // Add a new song while all existing songs have been played
    queue.add(makeSong("C"));
    const song = queue.next();
    expect(song).not.toBeNull();
    expect(song!.id).toBe("C");
    // After C, should stop
    expect(queue.next()).toBeNull();
  });

  it("random mode: setMode preserves current song as played", () => {
    queue.add(makeSong("A"));
    queue.add(makeSong("B"));
    queue.play(); // plays A in sequential mode
    queue.setMode(PlayMode.Random); // switch to random — A should be marked played
    // next() should only return B, never A again
    const song = queue.next();
    expect(song?.id).toBe("B");
    expect(queue.next()).toBeNull();
  });

  it("random-loop mode never returns null", () => {
    queue.setMode(PlayMode.RandomLoop);
    queue.add(makeSong("1"));
    queue.play();
    for (let i = 0; i < 10; i++) {
      expect(queue.next()).not.toBeNull();
    }
  });

  it("playAt jumps to specific index", () => {
    queue.add(makeSong("1"));
    queue.add(makeSong("2"));
    queue.add(makeSong("3"));
    queue.playAt(2);
    expect(queue.current()?.id).toBe("3");
  });

  describe("history-aware prev", () => {
    it("walks back through played indices in random mode", () => {
      queue.setMode(PlayMode.Random);
      queue.add(makeSong("a"));
      queue.add(makeSong("b"));
      queue.add(makeSong("c"));
      queue.add(makeSong("d"));
      queue.add(makeSong("e"));

      // Force a deterministic random sequence: a → c → e
      queue.playAt(0);
      queue.playAt(2);
      queue.playAt(4);
      expect(queue.current()?.id).toBe("e");

      // prev pops back through history: e → c → a
      expect(queue.prev()?.id).toBe("c");
      expect(queue.prev()?.id).toBe("a");
    });

    it("returns null when history is empty in random mode", () => {
      queue.setMode(PlayMode.Random);
      queue.add(makeSong("a"));
      queue.add(makeSong("b"));
      queue.playAt(0);
      // No further moves → history is empty (only 'a' is current, never pushed)
      expect(queue.prev()).toBeNull();
    });

    it("preserves sequential prev when history is empty", () => {
      queue.setMode(PlayMode.Sequential);
      queue.add(makeSong("a"));
      queue.add(makeSong("b"));
      queue.add(makeSong("c"));
      queue.play();
      queue.next(); // currentIndex = 1
      // Sequential next() pushed 0 to history → prev pops back to 0
      expect(queue.prev()?.id).toBe("a");
    });

    it("clears history on play()", () => {
      queue.setMode(PlayMode.Random);
      queue.add(makeSong("a"));
      queue.add(makeSong("b"));
      queue.playAt(0);
      queue.playAt(1);
      queue.play(); // resets to index 0 and clears history
      expect(queue.prev()).toBeNull();
    });

    it("clears history on clear()", () => {
      queue.add(makeSong("a"));
      queue.add(makeSong("b"));
      queue.play();
      queue.next();
      queue.clear();
      queue.add(makeSong("c"));
      queue.play();
      // History was wiped — no prev path available beyond index 0
      expect(queue.prev()).toBeNull();
    });

    it("clears history on setMode()", () => {
      queue.setMode(PlayMode.Sequential);
      queue.add(makeSong("a"));
      queue.add(makeSong("b"));
      queue.play();
      queue.next();
      // Mode change resets context
      queue.setMode(PlayMode.Random);
      expect(queue.prev()).toBeNull();
    });

    it("drops history entries pointing at a removed song", () => {
      queue.setMode(PlayMode.Random);
      queue.add(makeSong("a"));
      queue.add(makeSong("b"));
      queue.add(makeSong("c"));
      queue.playAt(0);
      queue.playAt(1); // history: [0]
      queue.playAt(2); // history: [0, 1]
      // Remove song at index 1 → history entry 1 dropped
      queue.remove(1);
      // queue is now [a, c], history should be [0]
      // current was at 2 → after remove shifts to 1 → song "c"
      expect(queue.current()?.id).toBe("c");
      expect(queue.prev()?.id).toBe("a");
    });

    it("does not push to history on prev itself", () => {
      queue.setMode(PlayMode.Random);
      queue.add(makeSong("a"));
      queue.add(makeSong("b"));
      queue.add(makeSong("c"));
      queue.playAt(0);
      queue.playAt(1);
      queue.playAt(2); // history: [0, 1]
      queue.prev();    // pops 1, history: [0]
      queue.prev();    // pops 0, history: []
      expect(queue.prev()).toBeNull(); // no fallback target in random mode
    });
  });
});
