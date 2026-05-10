import { Badge } from '@mantine/core';

import { IconBulb } from '@tabler/icons-react';

import { copyToClipboard } from 'fpp/utils/copy-top-clipboard.util';

export const Bookmark = ({ userId }: { userId: string }) => {
  const handleCopyUrl = () => {
    if (!window.location) {
      return;
    }
    copyToClipboard(window.location.toString(), userId);
  };

  return (
    <div>
      <Badge
        leftSection={<IconBulb size={20} className="-ml-1 mb-[3px] mr-[5px]" />}
        size="xl"
        variant="outline"
        color="gray"
        className="text-white/80 font-normal normal-case border-[#424242] hover:bg-[#2e2e2e] cursor-pointer md:text-base text-sm"
        onClick={handleCopyUrl}
      >
        <span className="md:block hidden">Bookmark and share the URL</span>
        <span className="md:hidden block">Bookmark & Share URL</span>
      </Badge>
    </div>
  );
};
