import React from "react";

const Avatar = ({ userId, username, online }) => {
  const colors = ["bg-teal-200", "bg-red-200", "bg-green-200", "bg-violet-200", "bg-blue-200", "bg-yellow-200"];
  const userIdBase10 = parseInt(userId, 16);
  const colorIndex = userIdBase10 % colors.length;
  const color = colors[colorIndex];
  return (
    <div className={`relative w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
      <div className="opacity-70">{username[0]}</div>
      {online && <div className="absolute w-3 h-3 bg-green-400 -bottom-1 right-0 rounded-full border border-white"></div>}
      {!online && <div className="absolute w-3 h-3 bg-gray-300 -bottom-1 right-0 rounded-full border border-white"></div>}
    </div>
  );
};

export default Avatar;
