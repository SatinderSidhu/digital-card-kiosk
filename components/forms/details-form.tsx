"use client";

import type { CardDetails } from "@/lib/types";
import { Field, TextInput } from "../ui";

type Props = {
  value: CardDetails;
  onChange: (patch: Partial<CardDetails>) => void;
};

export function DetailsForm({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1">
      <Field label="Full name">
        <TextInput
          value={value.fullName}
          placeholder="Jane Doe"
          onChange={(e) => onChange({ fullName: e.target.value })}
        />
      </Field>
      <Field label="Title">
        <TextInput
          value={value.title}
          placeholder="Head of Design"
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Company">
        <TextInput
          value={value.company}
          placeholder="Acme Inc."
          onChange={(e) => onChange({ company: e.target.value })}
        />
      </Field>
      <Field label="Phone">
        <TextInput
          value={value.phone}
          inputMode="tel"
          placeholder="+1 555 123 4567"
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </Field>
      <Field label="Email">
        <TextInput
          value={value.email}
          inputMode="email"
          placeholder="jane@acme.com"
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </Field>
      <Field label="Website">
        <TextInput
          value={value.website}
          inputMode="url"
          placeholder="acme.com"
          onChange={(e) => onChange({ website: e.target.value })}
        />
      </Field>
    </div>
  );
}
