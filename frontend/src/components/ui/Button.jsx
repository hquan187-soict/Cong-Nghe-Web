import Spinner from "./Spinner";

const variants = {
  primary: "bg-primary text-white hover:bg-primaryHover shadow-soft",
  secondary: "bg-secondary text-gray-700 border",
  danger: "bg-danger text-white hover:bg-red-500 shadow-soft",
};

const Button = ({ children, variant = "primary", isLoading }) => {
  return (
    <button
      className={`px-5 py-2.5 rounded-xl flex items-center gap-2 ${variants[variant]} ${
        isLoading ? "opacity-70" : ""
      }`}
      disabled={isLoading}
    >
      {isLoading && <Spinner />}
      {children}
    </button>
  );
};

export default Button;