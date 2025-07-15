import {
  ValidationFunction,
  ValidationResult,
  ValidationContext,
} from "../core/types";

class ValidatorRegistry {
  private validators: Record<string, ValidationFunction> = {};

  register(type: string, validator: ValidationFunction): void {
    this.validators[type] = validator;
  }

  get(type: string): ValidationFunction | undefined {
    return this.validators[type];
  }

  has(type: string): boolean {
    return !!this.validators[type];
  }
}

export const validatorRegistry = new ValidatorRegistry();

export function getValidator(type: string): ValidationFunction {
  const validator = validatorRegistry.get(type);

  if (!validator) {
    console.warn(`No validator found for type: ${type}, using 'any' validator`);
    return validatorRegistry.get("any") || ((value) => ({ isValid: true }));
  }

  return validator;
}

// Register built-in validators
validatorRegistry.register("any", (value: string): ValidationResult => {
  return { isValid: true };
});

validatorRegistry.register("required", (value: string): ValidationResult => {
  if (!value || value.trim() === "") {
    return {
      isValid: false,
      message: "This field is required",
    };
  }
  return { isValid: true };
});

validatorRegistry.register("name", (value: string): ValidationResult => {
  if (!value || value.trim().length < 2) {
    return {
      isValid: false,
      message: "Please enter a valid name (at least 2 characters)",
    };
  }
  return { isValid: true };
});

validatorRegistry.register("date", (value: string): ValidationResult => {
  // Accept ISO date format (YYYY-MM-DD)
  const re = /^\d{4}-\d{2}-\d{2}$/;

  if (!re.test(value)) {
    return {
      isValid: false,
      message: "Please follow the YYYY-MM-DD format (e.g. 2025-03-28)",
    };
  }

  // Validate date is real
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      message: "Please enter a valid date",
    };
  }

  return { isValid: true };
});

validatorRegistry.register("email", (value: string): ValidationResult => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(value)) {
    return {
      isValid: false,
      message: "Please enter a valid email address",
    };
  }
  return { isValid: true };
});

validatorRegistry.register("phone", (value: string): ValidationResult => {
  const re = /^\d{10,15}$/;
  if (!re.test(value.replace(/[\s-()]/g, ""))) {
    return {
      isValid: false,
      message: "Please enter a valid phone number (10-15 digits)",
    };
  }
  return { isValid: true };
});

validatorRegistry.register(
  "option",
  (value: string, context?: ValidationContext): ValidationResult => {
    // Get options from the question context
    if (!context || !context.userAnswers.options) {
      return { isValid: true }; // No context to validate against
    }

    const options = context.userAnswers.options.split(",");

    if (options.length > 0 && !options.includes(value)) {
      return {
        isValid: false,
        message: `Please select one of the options: ${options.join(", ")}`,
      };
    }

    return { isValid: true };
  }
);

validatorRegistry.register("passport", (value: string): ValidationResult => {
  // Trim whitespace
  const trimmedValue = value.trim();

  // Check if empty
  if (!trimmedValue) {
    return {
      isValid: false,
      message: "Passport number is required.",
    };
  }

  // Check minimum length
  if (trimmedValue.length < 4) {
    return {
      isValid: false,
      message: "Passport number must be at least 4 characters long.",
    };
  }

  // Check maximum length
  if (trimmedValue.length > 20) {
    return {
      isValid: false,
      message: "Passport number cannot exceed 20 characters.",
    };
  }

  // Allow letters, numbers, spaces, and common separators (but not special symbols)
  const re = /^[A-Za-z0-9\s\-]+$/;
  if (!re.test(trimmedValue)) {
    return {
      isValid: false,
      message:
        "Passport number can only contain letters, numbers, spaces, and hyphens.",
    };
  }

  // Ensure it's not just spaces or hyphens
  if (!/[A-Za-z0-9]/.test(trimmedValue)) {
    return {
      isValid: false,
      message: "Passport number must contain at least one letter or number.",
    };
  }

  return { isValid: true };
});

validatorRegistry.register("address", (value: string): ValidationResult => {
  if (!value || value.trim().length < 10) {
    return {
      isValid: false,
      message:
        "Please enter a complete address with at least 10 characters (house number, street, city, state, postal code, country)",
    };
  }

  // Check for minimum components (should have at least 3 commas or similar separators)
  const components = value.split(/[,\n]/);
  if (components.length < 3) {
    return {
      isValid: false,
      message:
        "Please provide a complete address including house number, street, city, state, postal code, and country. You can separate components with commas.",
    };
  }

  return { isValid: true };
});
