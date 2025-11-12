import dynamic from "next/dynamic";
import React from "react";

const ReplyAgent = dynamic(() => import("../components/ReplyAgent"), { ssr: false });

export default function Page() {
  return (
    <div className="page">
      <ReplyAgent />
    </div>
  );
}
