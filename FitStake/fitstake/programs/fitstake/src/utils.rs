#[macro_export]
macro_rules! dev_event {
    ($event:expr) => {
        #[cfg(feature = "dev")]
        {
            anchor_lang::prelude::emit!($event);
        }
    };
}
