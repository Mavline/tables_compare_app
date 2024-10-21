// src/custom.d.ts

declare module 'file-saver';

declare module '@/components/ui/button' {
  export const Button: React.FC<any>;
}

declare module '@/components/ui/checkbox' {
  export const Checkbox: React.FC<any>;
}

declare module '@/components/ui/input' {
  export const Input: React.FC<any>;
}

declare module '@/components/ui/label' {
  export const Label: React.FC<any>;
}

declare module '@/components/ui/alert' {
  export const Alert: React.FC<any>;
  export const AlertDescription: React.FC<any>;
}

declare module '@/components/ui/select' {
  export const Select: React.FC<any>;
  export const SelectContent: React.FC<any>;
  export const SelectItem: React.FC<any>;
  export const SelectTrigger: React.FC<any>;
  export const SelectValue: React.FC<any>;
}