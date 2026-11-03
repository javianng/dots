"use client";

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { todayKey } from "@/lib/dates";
import { MAX_LIFE_EXPECTANCY, MIN_LIFE_EXPECTANCY } from "@/lib/life";

/** Date of birth + life expectancy inputs, shared with sign-up. */
export function LifeFields({
  birthDate,
  onBirthDateChange,
  years,
  onYearsChange,
  error,
  required = true,
}: {
  birthDate: string;
  onBirthDateChange: (value: string) => void;
  years: string;
  onYearsChange: (value: string) => void;
  error?: string | null;
  required?: boolean;
}) {
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="birth-date">Date of birth</FieldLabel>
        <Input
          id="birth-date"
          type="date"
          autoComplete="bday"
          max={todayKey()}
          value={birthDate}
          onChange={(e) => onBirthDateChange(e.target.value)}
          required={required}
        />
      </Field>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="life-expectancy">
          How long do you expect to live? (years)
        </FieldLabel>
        <Input
          id="life-expectancy"
          type="number"
          inputMode="numeric"
          min={MIN_LIFE_EXPECTANCY}
          max={MAX_LIFE_EXPECTANCY}
          step={1}
          value={years}
          onChange={(e) => onYearsChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          required={required}
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </FieldGroup>
  );
}
