export default function Stepper({
  value,
  onChange,
  min = 0,
  max = 10,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <span className="stepper">
      <button onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="decrease">
        −
      </button>
      <span className="val">{value}</span>
      <button onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="increase">
        +
      </button>
    </span>
  );
}
