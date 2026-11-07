export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return (
    <p role="alert" className="field-error">
      {messages[0]}
    </p>
  );
}
