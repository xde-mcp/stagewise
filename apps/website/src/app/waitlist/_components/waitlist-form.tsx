'use client';

import { useEffect, useState } from 'react';
import { FormRegistered } from './form-registered';
import { FormUnregistered } from './form-unregistered';

interface WaitlistFormData {
  email: string;
}

export function WaitlistForm() {
  const [formData, setFormData] = useState<WaitlistFormData>({
    email: '',
  });
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    const email = localStorage.getItem('stagewise_waitlist_email');
    if (email) {
      setIsRegistered(true);
      setFormData((prev) => ({
        ...prev,
        email,
      }));
    }
  }, []);

  const handleRegistrationSuccess = (email: string) => {
    setFormData((prev) => ({
      ...prev,
      email,
    }));
    setIsRegistered(true);
  };

  return isRegistered ? (
    <FormRegistered email={formData.email} subscriberEmail={formData.email} />
  ) : (
    <FormUnregistered
      formData={formData}
      setFormData={setFormData}
      onRegistrationSuccess={handleRegistrationSuccess}
    />
  );
}
