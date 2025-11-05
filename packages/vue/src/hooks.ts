import { ref, onMounted, onUnmounted } from "vue";

export const useIsDocumentHidden = () => {
  const isDocumentHidden = ref(
    typeof document !== "undefined" ? document.hidden : false
  );

  onMounted(() => {
    const callback = () => {
      isDocumentHidden.value = document.hidden;
    };
    document.addEventListener("visibilitychange", callback);
    onUnmounted(() =>
      document.removeEventListener("visibilitychange", callback)
    );
  });

  return isDocumentHidden;
};
