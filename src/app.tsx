import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { useState } from "react";
import useSWR from "swr";
import { TimeStampInput } from "./components/time-stamp-input.tsx";

function useFfmpeg() {
  return useSWR("ffmpeg", async () => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      console.log(message);
    });
    ffmpeg.on("progress", ({ progress }) => {
      console.log(progress);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    return ffmpeg;
  });
}

export type TimeStamp = {
  h: number;
  m: number;
  s: number;
};

type TranscodeOptions = {
  width: number;
  fps: number;
  from: TimeStamp;
  to: TimeStamp;
};

function timeStampToSeconds(timeStamp: TimeStamp): number {
  return timeStamp.h * 3600 + timeStamp.m * 60 + timeStamp.s;
}

function formatTimeStamp(timeStamp: TimeStamp): string {
  const h = String(timeStamp.h).padStart(2, "0");
  const m = String(timeStamp.m).padStart(2, "0");
  const s = String(timeStamp.s).padStart(2, "0");

  return `${h}:${m}:${s}`;
}

function secondsToTimeStamp(seconds: number): TimeStamp {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor((seconds % 3600) % 60);

  return { h, m, s };
}

async function transcode(
  ffmpeg: FFmpeg,
  video: File,
  options: TranscodeOptions
): Promise<ArrayBufferLike> {
  const videoFileData = await video
    .arrayBuffer()
    .then((buffer) => new Uint8Array(buffer));

  // await ffmpeg.deleteFile(video.name);
  await ffmpeg.writeFile(video.name, videoFileData);

  const paletteArgs = [
    "-hide_banner",
    "-nostats",
    "-v",
    "warning",
    "-ss",
    formatTimeStamp(options.from),
    "-to",
    formatTimeStamp(options.to),
    "-i",
    video.name,
    "-fps_mode",
    "vfr",
    "-lavfi",
    `fps=${options.fps},trim=start_frame=${
      timeStampToSeconds(options.from) * options.fps
    }:end_frame=${
      timeStampToSeconds(options.to) * options.fps
    },setpts=PTS-STARTPTS,scale=${
      options.width
    }:-1:flags=lanczos,palettegen=stats_mode=diff`,
    "palette.png",
  ];

  await ffmpeg.exec(paletteArgs);
  const paletteFileData = await ffmpeg.readFile("palette.png");
  await ffmpeg.writeFile("palette.png", paletteFileData);
  const gifArgs = [
    "-hide_banner",
    "-nostats",
    "-v",
    "warning",
    "-ss",
    formatTimeStamp(options.from),
    "-to",
    formatTimeStamp(options.to),
    "-i",
    video.name,
    "-i",
    "palette.png",
    "-fps_mode",
    "vfr",
    "-lavfi",
    `fps=${options.fps},trim=start_frame=${
      timeStampToSeconds(options.from) * options.fps
    }:end_frame=${
      timeStampToSeconds(options.to) * options.fps
    },setpts=PTS-STARTPTS,scale=${
      options.width
    }:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
    "output.gif",
  ];

  await ffmpeg.exec(gifArgs);

  const gifFileData = await ffmpeg.readFile("output.gif");
  const gifData = new Uint8Array(gifFileData as ArrayBuffer);

  return gifData.buffer;
}

export function App() {
  const { data: ffmpeg } = useFfmpeg();

  const [srcs, setSrcs] = useState<string[]>([]);
  const [video, setVideo] = useState<null | File>(null);

  const [width, setWidth] = useState(256);
  const [fps, setFps] = useState(15);
  const [timeStampFrom, setTimeStampFrom] = useState<TimeStamp>({
    h: 0,
    m: 0,
    s: 0,
  });
  const [timeStampTo, setTimeStampTo] = useState<TimeStamp>({
    h: 0,
    m: 0,
    s: 0,
  });
  // [TODO] Migrate to react hook form

  return (
    <div>
      {ffmpeg ? (
        <div className="flex flex-col w-80 p-4 bg-yellow-200">
          <input
            type="file"
            id="videoInput"
            accept="video/*"
            onChange={async (event) => {
              if (event.target.files) {
                const file = event.target.files[0];
                setVideo(file);

                const url = URL.createObjectURL(file);
                const $video = document.createElement("video");
                $video.src = url;
                $video.addEventListener("loadedmetadata", () => {
                  setWidth($video.videoWidth);
                  setTimeStampTo(secondsToTimeStamp($video.duration));
                });
              }
            }}
          />
          {srcs.map((src) => (
            <img src={src} key={src} />
          ))}
          <div className="grid grid-cols-1">
            <input
              type="number"
              inputMode="numeric"
              className="bg-white border"
              value={fps}
              onChange={(e) => setFps(e.target.valueAsNumber)}
            />
            <TimeStampInput
              timeStamp={timeStampFrom}
              onChange={setTimeStampFrom}
            />
            <TimeStampInput timeStamp={timeStampTo} onChange={setTimeStampTo} />
          </div>
          <button
            className="bg-white cursor-pointer disabled:bg-gray-100"
            disabled={video === null}
            onClick={async () => {
              if (video === null) {
                throw new Error("Should not happen");
              }

              const transcoded = await transcode(ffmpeg, video, {
                width,
                fps,
                from: timeStampFrom,
                to: timeStampTo,
              });
              setSrcs([
                ...srcs,
                URL.createObjectURL(
                  new Blob([transcoded], { type: "image/gif" })
                ),
              ]);
            }}
          >
            Convert
          </button>
        </div>
      ) : (
        <div>loading...</div>
      )}
    </div>
  );
}
