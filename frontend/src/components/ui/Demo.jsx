import { useState } from "react";
import Button from "./Button";
import Input from "./Input";
import Avatar from "./Avatar";

const Demo = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!value) {
      setError(""); // chưa nhập → không lỗi
    } else if (!emailRegex.test(value)) {
      setError("Invalid email"); // sai
    } else {
      setError(""); // đúng
    }
  };

  return (
    <div className="space-y-12">

      {}
      <div>
        <h2 className="text-2xl font-semibold mb-6">Buttons</h2>
        <div className="flex gap-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button isLoading>Loading...</Button>
        </div>
      </div>

      {}
      <div>
        <h2 className="text-2xl font-semibold mb-6">Inputs</h2>

        <div className="space-y-5 max-w-md">
          <Input
            label="Username"
            placeholder="Enter username"
          />

          <Input
            label="Email"
            placeholder="Enter email"
            value={email}
            onChange={handleEmailChange}
            error={error}
          />

          <Input
            label="Search"
            placeholder="Search..."
            icon="🔍"
          />
        </div>
      </div>

      {}
      <div>
        <h2 className="text-2xl font-semibold mb-6">Avatars</h2>

        <div className="flex gap-6 items-center">
          <Avatar size="sm" src="https://i.pravatar.cc/100" />
          <Avatar size="md" src="https://i.pravatar.cc/100" isOnline />
          <Avatar size="lg" src="https://i.pravatar.cc/100" />
        </div>
      </div>

    </div>
  );
};

export default Demo;