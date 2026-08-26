import type { JSONSchema } from "formhell";

export const profileSchema: JSONSchema = {
  $id: "https://example.com/schemas/profile",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Profile",
  type: "object",
  required: ["firstName", "age", "contact", "tags"],
  properties: {
    firstName: {
      title: "First Name",
      type: "string"
    },
    role: {
      title: "Role",
      type: "string",
      enum: ["admin", "editor", "viewer"]
    },
    age: {
      title: "Age",
      type: "integer"
    },
    active: {
      title: "Is Active",
      type: "boolean"
    },
    contact: {
      title: "Contact",
      $ref: "#/$defs/contact"
    },
    tags: {
      title: "Tags",
      type: "array",
      items: {
        type: "string"
      }
    },
    addresses: {
      title: "Addresses",
      type: "array",
      items: {
        $ref: "https://example.com/schemas/address#/definitions/address"
      }
    }
  },
  $defs: {
    contact: {
      type: "object",
      required: ["email"],
      properties: {
        email: {
          title: "Email",
          type: "string"
        },
        phone: {
          title: "Phone",
          type: "string"
        }
      }
    }
  }
};

export const peerSchemasArray: JSONSchema[] = [
  {
    $id: "https://example.com/schemas/address",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    definitions: {
      address: {
        type: "object",
        required: ["line1", "city"],
        properties: {
          line1: { title: "Line 1", type: "string" },
          city: { title: "City", type: "string" },
          zip: { title: "Zip", type: "string" }
        }
      }
    }
  }
];

export const initialProfileData = {
  firstName: "Ada",
  role: "admin",
  age: 36,
  active: true,
  contact: {
    email: "ada@example.com",
    phone: "555-1111"
  },
  tags: ["core", "beta"],
  addresses: [
    {
      line1: "1 Main St",
      city: "Seattle",
      zip: "98101"
    }
  ]
};
