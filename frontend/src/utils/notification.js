import { toast } from "react-toastify";

/**
 * Reusable DiaSense Notification Service.
 * Renders compact, centered, dark-themed notifications with appropriate icons and restrained colors.
 */
export const notify = {
  success: (message, options = {}) => {
    return toast.success(message, {
      role: "alert",
      ...options,
    });
  },
  error: (message, options = {}) => {
    return toast.error(message, {
      role: "alert",
      autoClose: 4000,
      ...options,
    });
  },
  warning: (message, options = {}) => {
    return toast.warning(message, {
      role: "alert",
      autoClose: 3500,
      ...options,
    });
  },
  info: (message, options = {}) => {
    return toast.info(message, {
      role: "status",
      ...options,
    });
  },
  dismiss: (id) => toast.dismiss(id),
  clearAll: () => toast.dismiss(),
};

export default notify;
