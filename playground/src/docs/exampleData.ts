import type { JSONSchema, OutputData } from "formhell";

export const quickStartSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Profile",
  type: "object",
  properties: {
    firstName: { type: "string", title: "First name" },
    age: { type: "integer", minimum: 0 }
  },
  required: ["firstName"]
};

export const quickStartData: OutputData = { firstName: "Ada", age: 36 };

export const virtualizationSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Inventory",
  type: "object",
  properties: {
    items: {
      title: "Warehouse Items",
      type: "array",
      items: {
        type: "object",
        required: ["sku", "quantity"],
        properties: {
          sku: { title: "SKU", type: "string" },
          quantity: { title: "Quantity", type: "integer", minimum: 0 },
          location: { title: "Location", type: "string" }
        }
      }
    }
  }
};

export function buildVirtualizationData(count = 500): OutputData {
  return {
    items: Array.from({ length: count }, (_, index) => ({
      sku: `SKU-${1000 + index}`,
      quantity: (index * 7) % 250,
      location: `Aisle ${1 + (index % 12)}`
    }))
  };
}

export const asyncRefSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Profile",
  type: "object",
  required: ["name"],
  properties: {
    name: {
      title: "Name",
      type: "string"
    },
    color: {
      title: "Color",
      $ref: "https://example.com/schemas/color#/definitions/color"
    }
  }
};

export const colorSchema: JSONSchema = {
  $id: "https://example.com/schemas/color",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  definitions: {
    color: {
      title: "Color",
      type: "string",
      pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
    }
  }
};

export const customWidgetSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Account",
  type: "object",
  properties: {
    displayName: { title: "Display Name", type: "string" }
  }
};

export const validationErrorSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Signup",
  type: "object",
  required: ["email", "age"],
  properties: {
    email: { title: "Email", type: "string", format: "email" },
    age: { title: "Age", type: "integer", minimum: 18 }
  }
};

export const validationErrorData: OutputData = { age: 12 };

export const advancedExampleSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Access Request",
  type: "object",
  properties: {
    role: { type: "string", title: "Role", enum: ["admin", "editor", "viewer"] },
    tags: {
      type: "array",
      title: "Tags",
      prefixItems: [{ type: "string", title: "Category" }, { type: "integer", title: "Priority" }],
      items: false,
      minItems: 2
    },
    metadata: {
      type: "object",
      title: "Metadata",
      patternProperties: {
        "^x-": { type: "string" }
      },
      unevaluatedProperties: { type: "string" }
    }
  },
  dependentRequired: {
    role: ["tags"]
  },
  if: { required: ["role"], properties: { role: { const: "admin" } } },
  then: {
    properties: {
      metadata: {
        properties: {
          "x-audit": { title: "Audit Note", type: "string" }
        }
      }
    }
  }
};

export const builderStartingSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "New Schema",
  type: "object",
  properties: {}
};

export const localizationSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Preferences",
  type: "object",
  required: ["favoriteColor"],
  properties: {
    favoriteColor: { title: "Favorite Color", type: "string" },
    subscribed: { title: "Subscribed", type: "boolean" },
    plan: { title: "Plan", type: "string", enum: ["free", "pro", "team"] },
    hobbies: {
      title: "Hobbies",
      type: "array",
      items: { type: "string" }
    }
  }
};

export const themingSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Card Details",
  type: "object",
  required: ["cardholder"],
  properties: {
    cardholder: { title: "Cardholder Name", type: "string" },
    plan: { title: "Plan", type: "string", enum: ["free", "pro", "team"] },
    tags: {
      title: "Tags",
      type: "array",
      items: { type: "string" }
    }
  }
};
