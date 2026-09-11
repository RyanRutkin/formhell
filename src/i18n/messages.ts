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
    tupleLabel: "Tuple {index}"
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
  }
};
