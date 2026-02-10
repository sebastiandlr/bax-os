type ErrorListProps = {
  errors: string[];
  className: string;
};

export function ErrorList({ errors, className }: ErrorListProps) {
  return (
    <ul className={className}>
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}
