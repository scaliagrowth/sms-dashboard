type Props = {
  label: string;
  value: string | null | undefined;
};

export function StatusBadge({ label, value }: Props) {
  return (
    <div className="statusBadge">
      <span className="statusBadgeLabel">{label}</span>
      <span className="statusBadgeValue">{value && value.trim() ? value : '—'}</span>
    </div>
  );
}
