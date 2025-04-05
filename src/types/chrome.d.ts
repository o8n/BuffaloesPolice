// Chrome extension API type declarations
declare namespace chrome {
  namespace storage {
    namespace sync {
      function get(
        keys: string | string[] | object | null,
        callback: (items: { [key: string]: any }) => void
      ): void;
      
      function set(
        items: { [key: string]: any },
        callback?: () => void
      ): void;
    }
  }
  
  namespace runtime {
    function getURL(path: string): string;
  }
}
