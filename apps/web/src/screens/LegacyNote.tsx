/** Said once, plainly: the questions come from the older bank, so the teacher chooses the topic herself. */
export function LegacyNote({ className }: { className?: string }) {
  const balvatika = className === 'Balvatika';
  return (
    <p className="note">
      {balvatika
        ? 'The reviewed Balvatika questions are not ready yet. The topics below come from the older question bank, which mostly covers Class 1 to 5 topics. Choose a topic only if it suits your children.'
        : 'These topics come from the older question bank. Choose the topic you have taught.'}
    </p>
  );
}
