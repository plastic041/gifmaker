import type { TimeStamp } from "../app";
import type { SetStateAction, Dispatch } from "react";

type TimeStampInputProps = {
  timeStamp: TimeStamp;
  onChange: Dispatch<SetStateAction<TimeStamp>>;
};
export function TimeStampInput({ timeStamp, onChange }: TimeStampInputProps) {
  return (
    <div className="grid grid-cols-3">
      <input
        className="border bg-white"
        value={timeStamp.m}
        onChange={(event) => {
          const h = event.target.valueAsNumber;
          onChange({ ...timeStamp, h });
        }}
        type="number"
        inputMode="numeric"
      />
      <input
        className="border bg-white"
        value={timeStamp.m}
        onChange={(event) => {
          const m = event.target.valueAsNumber;
          onChange({ ...timeStamp, m });
        }}
        type="number"
        inputMode="numeric"
      />
      <input
        className="border bg-white"
        value={timeStamp.s}
        onChange={(event) => {
          const s = event.target.valueAsNumber;
          onChange({ ...timeStamp, s });
        }}
        type="number"
        inputMode="numeric"
      />
    </div>
  );
}
