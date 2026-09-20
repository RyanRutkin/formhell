export interface FormHellMessages {
  form: {
    defaultTitle: string;
  };
  status: {
    waitingForPeerSchemas: string;
    resolvingRefs: string;
  };
  field: {
    optional: string;
    requiredMarker: string;
    typeChooser: string;
    insertNull: string;
  };
  array: {
    addItem: string;
    remove: string;
    itemLabel: string;
    tupleLabel: string;
    itemAdded: string;
    itemRemoved: string;
    itemCount: string;
    expand: string;
    collapse: string;
  };
  boolean: {
    trueLabel: string;
    falseLabel: string;
  };
  select: {
    placeholder: string;
  };
  nullField: {
    description: string;
  };
  object: {
    showMore: string;
    showLess: string;
    addProperty: string;
    propertyNameLabel: string;
    propertyNamePlaceholder: string;
    removeProperty: string;
    invalidPropertyName: string;
    propertyAdded: string;
    propertyRemoved: string;
  };
  union: {
    branchLabel: string;
    branchLabelIndexed: string;
    branchOption: string;
  };
  validation: {
    summaryTitle: string;
  };
}

export const defaultMessages: FormHellMessages = {
  form: {
    defaultTitle: "Schema Form"
  },
  status: {
    waitingForPeerSchemas: "Waiting for required peer schema(s)",
    resolvingRefs: "Resolving schema references..."
  },
  field: {
    optional: "Optional",
    requiredMarker: "*",
    typeChooser: "{label} type chooser",
    insertNull: "Insert NULL"
  },
  array: {
    addItem: "Add Item",
    remove: "Remove",
    itemLabel: "Item {index}",
    tupleLabel: "Tuple {index}",
    itemAdded: "Item {index} added",
    itemRemoved: "Item {index} removed",
    itemCount: "{count} items",
    expand: "Expand collection",
    collapse: "Collapse collection"
  },
  boolean: {
    trueLabel: "True",
    falseLabel: "False"
  },
  select: {
    placeholder: "Select..."
  },
  nullField: {
    description: "Value is always null."
  },
  object: {
    showMore: "Show {count} more properties",
    showLess: "Show fewer properties",
    addProperty: "Add Property",
    propertyNameLabel: "New property name",
    propertyNamePlaceholder: "Property name",
    removeProperty: "Remove property",
    invalidPropertyName: "\"{name}\" is not an allowed property name for this object.",
    propertyAdded: "Property {name} added",
    propertyRemoved: "Property {name} removed"
  },
  union: {
    branchLabel: "Variant",
    branchLabelIndexed: "Variant {index}",
    branchOption: "Option {index}"
  },
  validation: {
    summaryTitle: "Please correct the following:"
  }
};
