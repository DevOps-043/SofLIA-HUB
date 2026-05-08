import { useRef, useState } from 'react';
import type React from 'react';

export function UserAvatar({
  src,
  fallback,
}: {
  src?: string | null;
  fallback: React.ReactNode;
}) {
  const [error, setError] = useState(false);
  const prevSrc = useRef(src);

  if (prevSrc.current !== src) {
    prevSrc.current = src;
    if (error) setError(false);
  }

  if (!src || error) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt="User"
      className="w-full h-full object-cover"
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
}
