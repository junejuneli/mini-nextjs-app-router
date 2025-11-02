/// <reference types="react" />

// Make JSX namespace available globally for all components
declare global {
  namespace JSX {
    type Element = React.JSX.Element
    type IntrinsicElements = React.JSX.IntrinsicElements
  }
}

export {}
