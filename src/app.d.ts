declare global {
  namespace App {
    // A history entry owned by an open sheet, so Back closes it before leaving the page.
    interface PageState {
      sheet?: string;
    }
  }
}

export {};
