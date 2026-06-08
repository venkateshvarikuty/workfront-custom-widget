/*
 * <license header>
 */

import { Text } from "@adobe/react-spectrum";
import { register } from "@adobe/uix-guest";
import { extensionId } from "./Constants";
import metadata from '../../../../app-metadata.json';
import { icon1 } from './icons';

function ExtensionRegistration() {
  const init = async () => {
    const guestConnection = await register({
      metadata,
      methods: {
        id: extensionId,
        widgets: {
          getItems() {
            return [
              {
                id: 'custom-widget',
                url: '/index.html#/custom-widget',
                label: 'Generic Form',
                icon: icon1,
                dimensions: {
                  height: 500,
                  width: 700,
                  maxHeight: 700,
                  maxWidth: 900,
                },
              },
            // @todo YOUR HEADER BUTTONS DECLARATION SHOULD BE HERE
            ];
          },
        },
      }
    });
  };
  init().catch(console.error);

  return <Text>IFrame for integration with Host (Workfront)...</Text>;
}

export default ExtensionRegistration;
