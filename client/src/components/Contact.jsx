import React from "react";
import Avatar from "./Avatar";

const Contact = ({ id, username, onClick, selectedUserId, online }) => {
  return (
    <div onClick={() => onClick(id)} className={`border-b border-gray-100 flex items-center gap-2 cursor-pointer ${id === selectedUserId ? "bg-blue-50" : ""}`}>
      {id === selectedUserId && <div className="w-1 bg-blue-500 h-12 rounded-r-md"></div>}
      <div className="flex gap-2 py-2 pl-4 items-center">
        <Avatar online={online} username={username} userId={id} />
        <span className="text-slate-600">{username}</span>
      </div>
    </div>
  );
};

export default Contact;
