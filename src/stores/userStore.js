import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useUserStore = defineStore("user", () => {
    // Global reactive avatar
    const avatar = ref("/avatars/default.png");

    // Load from localStorage on start
    const storedAvatar = localStorage.getItem("userAvatar");
    if (storedAvatar) avatar.value = `/avatars/${storedAvatar}`;

    // Automatically persist to localStorage
    watch(avatar, (newVal) => {
        const clean = newVal.replace(/^\/?avatars\//, "");
        localStorage.setItem("userAvatar", clean);
    });

    // Simple setter
    const setAvatar = (newAvatar) => {
        const clean = newAvatar.replace(/^\/?avatars\//, "");
        avatar.value = `/avatars/${clean}`;
    };

    return { avatar, setAvatar };
});
