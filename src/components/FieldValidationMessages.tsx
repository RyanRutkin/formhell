import { createContext, useContext, type ReactNode } from "react";

interface FieldValidationMessagesValue {
  byPointer: Map<string, string[]>;
  enabled: boolean;
}

const FieldValidationMessagesContext = createContext<FieldValidationMessagesValue>({
  byPointer: new Map(),
  enabled: false
});

export function FieldValidationMessagesProvider({
  byPointer,
  enabled,
  children
}: FieldValidationMessagesValue & { children: ReactNode }) {
  return (
    <FieldValidationMessagesContext.Provider value={{ byPointer, enabled }}>
      {children}
    </FieldValidationMessagesContext.Provider>
  );
}

/** Validation messages for a single field, honouring the `showFieldValidationMessages` option. */
export function useFormHellFieldValidationMessages(pointer: string | undefined): string[] {
  const { byPointer, enabled } = useContext(FieldValidationMessagesContext);

  if (!enabled || pointer === undefined) {
    return [];
  }

  return byPointer.get(pointer) ?? [];
}

export function FieldValidationMessages({ pointer }: { pointer: string | undefined }) {
  const messages = useFormHellFieldValidationMessages(pointer);

  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className="raf-field-messages" role="alert">
      {messages.map((message, index) => (
        <li key={`${message}-${index}`} className="raf-field-message">
          {message}
        </li>
      ))}
    </ul>
  );
}
